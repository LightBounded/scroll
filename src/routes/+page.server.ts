import { redirect } from '@sveltejs/kit';
import { type User } from 'svelte-clerk/server';

export async function load({ locals }) {
	const user = await locals.currentUser();

	if (user == null) {
		return redirect(307, '/sign-in');
	}

	return {
		user: JSON.parse(JSON.stringify(user)) as User
	};
}
