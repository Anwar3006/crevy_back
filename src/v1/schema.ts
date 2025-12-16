// Export enums first to avoid SQL error with not finding them during table creation
// Export tables
// Export relations
export {
	company,
	companyRelationWithUser,
	projectOwner,
	projectOwnerRelationWithUser,
	userRelations,
	users,
	userTypeEnum,
} from "@v1/auth/models/userModel";
