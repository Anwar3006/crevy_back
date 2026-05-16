// Export enums first to avoid SQL error with not finding them during table creation
// Export tables
// Export relations
export {
  company,
  companyRelationWithUser,
  projectOwner,
  projectOwnerRelationWithUser,
} from "./auth/models/auth-extension-model";

export {
  userTypeEnum,
  // userSexEnum,
  user,
  userRelations,
  session,
  sessionRelations,
  account,
  accountRelations,
  verification,
} from "./auth/models/auth-model";

export {
  projectStatusEnum,
  projectTypeEnum,
  regenerativePractices,
  project,
  projectPractices,
  projectDocument,
  carbonSequestrationLog,
  projectRelations,
  regenerativePracticesRelations,
  projectPracticesRelations,
  projectDocumentRelations,
  carbonSequestrationLogRelations,
} from "./projects/models/project-model";
