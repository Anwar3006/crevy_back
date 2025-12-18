// Export enums first to avoid SQL error with not finding them during table creation
// Export tables
// Export relations
export {
  company,
  companyRelationWithUser,
  projectOwner,
  projectOwnerRelationWithUser,
} from "@v1/auth/models/auth-extension-model";

export {
  userTypeEnum,
  user,
  userRelations,
  session,
  sessionRelations,
  account,
  accountRelations,
  verification,
} from "@v1/auth/models/auth-model";
