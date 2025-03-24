import { redirect } from '@sveltejs/kit';
import { clerkClient, type User } from 'svelte-clerk/server';

export async function load({ locals }) {
	const { userId } = locals.auth;

	if (!userId) {
		return redirect(307, '/sign-in');
	}

	const user = await clerkClient.users.getUser(userId);

	return {
		user: JSON.parse(JSON.stringify(user)) as User
	};
}
