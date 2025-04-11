# Scroll

## Deploying

### Dependencies

Have [NodeJS](https://nodejs.org/en) installed, [pnpm](https://pnpm.io/) installed, 
as well as a [Clerk](https://clerk.com/) app setup with the .env file parameters filled 
(reference .env.example).

Note that the application runs on port 5173.

### Building locally

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.

### Deploying to cloud

Depending on where you want to deploy, install the appropiate 
[adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## AI Disclaimer

We did occasionaly reference ChatGPT and Copilot for help as we were developing.