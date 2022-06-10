import User from '../../../models/User';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { Tele } from 'nc-help';

import bcrypt from 'bcryptjs';

export default async function initAdminFromEnv() {
  if (process.env.NC_ADMIN_EMAIL && process.env.NC_ADMIN_PAASWORD) {
    const salt = await promisify(bcrypt.genSalt)(10);
    const password = await promisify(bcrypt.hash)(
      process.env.NC_ADMIN_PAASWORD,
      salt
    );
    const email_verification_token = uuidv4();

    // if super admin not present
    if (await User.isFirst()) {
      const email = process.env.NC_ADMIN_EMAIL.toLowerCase();

      const roles = 'user,super';

      // roles = 'owner,creator,editor'
      Tele.emit('evt', {
        evt_type: 'project:invite',
        count: 1
      });

      await User.insert({
        firstname: '',
        lastname: '',
        email,
        salt,
        password,
        email_verification_token,
        roles
      });
    }

    // if already exist
    // if admin email changed
    // if admin password changed
  }
}
