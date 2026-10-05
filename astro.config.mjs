// @ts-check
import { defineConfig } from 'astro/config';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'SKI-KOM-RML';
const isGitHubActions = !!process.env.GITHUB_ACTIONS;

export default defineConfig({
  site: isGitHubActions
    ? `https://${process.env.GITHUB_REPOSITORY_OWNER || 'github-user'}.github.io`
    : 'http://localhost:4321',
  base: isGitHubActions ? `/${repoName}/` : '/',
  trailingSlash: 'ignore',
});
