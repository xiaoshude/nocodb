import View from '../../models/View';
import Base from '../../models/Base';
import Model from '../../models/Model';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import { nocoExecute } from 'nc-help';
import { populateSingleQuery } from './pgQuery';

export async function getDataList(model: Model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });
  let data;
  const listArgs: any = { ...req.query, limit: 1 };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  if (process.env.NC_PG_OPTIMISE && base.type === 'pg') {
    data = await populateSingleQuery({ view, model, base, params: listArgs });
  } else {
    const requestObj = await getAst({ model, query: req.query, view });
    data = await nocoExecute(
      requestObj,
      await baseModel.list(listArgs),
      {},
      listArgs
    );
  }
  const count = 9000; // await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    ...req.query,
    count
  });
}
