import User from '../../../models/User';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { Tele } from 'nc-help';

import bcrypt from 'bcryptjs';
import Noco from '../../../Noco';
import { MetaTable } from '../../../utils/globals';
import ProjectUser from '../../../models/ProjectUser';

const { isEmail } = require('validator');
const rolesLevel = { owner: 0, creator: 1, editor: 2, commenter: 3, viewer: 4 };

export default async function initAdminFromEnv(_ncMeta = Noco.ncMeta) {
  if (process.env.NC_ADMIN_EMAIL && process.env.NC_ADMIN_PASSWORD) {
    let ncMeta;
    try {
      ncMeta = await _ncMeta.startTransaction();
      const email = process.env.NC_ADMIN_EMAIL.toLowerCase().trim();

      if (!isEmail(email)) {
        console.log(`Provided 'NC_ADMIN_EMAIL' value is not a valid email`);
      }

      const salt = await promisify(bcrypt.genSalt)(10);
      const password = await promisify(bcrypt.hash)(
        process.env.NC_ADMIN_PASSWORD,
        salt
      );
      const email_verification_token = uuidv4();

      // if super admin not present
      if (await User.isFirst(ncMeta)) {
        const roles = 'user,super';

        // roles = 'owner,creator,editor'
        Tele.emit('evt', {
          evt_type: 'project:invite',
          count: 1
        });

        await User.insert(
          {
            firstname: '',
            lastname: '',
            email,
            salt,
            password,
            email_verification_token,
            roles
          },
          ncMeta
        );
      } else {
        const salt = await promisify(bcrypt.genSalt)(10);
        const password = await promisify(bcrypt.hash)(
          process.env.NC_ADMIN_PASSWORD,
          salt
        );
        const email_verification_token = uuidv4();
        const superUser = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
          roles: 'user,super'
        });

        if (email !== superUser.email) {
          // update admin email and password and migrate projects
          // if user already present and associated with some project

          // check user account already present with the new admin email
          const existingUserWithNewEmail = await User.getByEmail(email, ncMeta);

          if (existingUserWithNewEmail) {
            // get all project access belongs to the existing account
            // and migrate to the admin account
            const existingUserProjects = await ncMeta.metaList2(
              null,
              null,
              MetaTable.PROJECT_USERS,
              {
                condition: { fk_user_id: existingUserWithNewEmail.id }
              }
            );

            for (const existingUserProject of existingUserProjects) {
              const userProject = await ProjectUser.get(
                existingUserProject.project_id,
                superUser.id,
                ncMeta
              );

              // if admin user already have access to the project
              // then update role based on the highest access level
              if (userProject) {
                if (
                  rolesLevel[userProject.roles] >
                  rolesLevel[existingUserProject.roles]
                ) {
                  await ProjectUser.update(
                    userProject.project_id,
                    superUser.id,
                    existingUserProject.roles,
                    ncMeta
                  );
                }
              } else {
                // if super doesn't have access then add the access
                await ProjectUser.insert(
                  {
                    ...existingUserProject,
                    fk_user_id: superUser.id
                  },
                  ncMeta
                );
              }
              // delete the old project access entry from DB
              await ProjectUser.delete(
                existingUserProject.project_id,
                existingUserProject.fk_user_id,
                ncMeta
              );
            }

            // delete existing user
            ncMeta.metaDelete(
              null,
              null,
              MetaTable.USERS,
              existingUserWithNewEmail.id
            );

            // Update email and password of super admin account
            await User.update(
              superUser.id,
              {
                salt,
                email,
                password,
                email_verification_token
              },
              ncMeta
            );
          } else {
            // if email's are not different update the password and hash
            await User.update(
              superUser.id,
              {
                salt,
                email,
                password,
                email_verification_token
              },
              ncMeta
            );
          }
        } else {
          // if email's are not different update the password and hash
          await User.update(
            superUser.id,
            {
              salt,
              password,
              email_verification_token
            },
            ncMeta
          );
        }
      }
      await ncMeta.commit();
    } catch (e) {
      console.log('Error occurred while updating/creating admin user');
      console.log(e);
      await ncMeta.rollback(e);
    }
  }
}
