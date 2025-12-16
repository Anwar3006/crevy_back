import bcrypt from "bcrypt";
import settings from "@/config/settings";

/**
 * Hashes a given password using bcrypt.
 * If an error occurs during the hashing process, it is logged to the console and null is returned.
 * The salt roundss used for hashing is obtained from the SALT_WORK_FACTOR environment variable.
 * If the environment variable is not set, a default value of 10 is used.
 * @param {string} password - The password to be hashed.
 * @returns {Promise<string | null>} - A promise resolving to the hashed password, or null if an error occurs.
 */
export const PasswordHasher = async (password: string) => {
	try {
		const saltRounds = Number.parseInt(settings.SALT_WORK_FACTOR) || 10;

		const hashed = await bcrypt.genSalt(saltRounds);
		return await bcrypt.hash(password, hashed);
	} catch (error: unknown) {
		console.error("Error hashing password: ", error);
		return null;
	}
};

/**
 * Compares a hashed password with a plain password.
 * Returns true if the comparison is successful, false otherwise.
 * If an error occurs during the comparison, false is returned and the error is logged to the console.
 * @param {string} hashedPassword - The hashed password to compare with.
 * @param {string} plainPassword - The plain password to compare with the hashed password.
 * @returns {Promise<boolean>} - A promise resolving to a boolean indicating whether the comparison was successful.
 */
export const PasswordComparer = async (
	hashedPassword: string,
	plainPassword: string,
) => {
	try {
		return await bcrypt.compare(plainPassword, hashedPassword);
	} catch (error: unknown) {
		console.error("Error comparing password: ", error);
		return false;
	}
};
