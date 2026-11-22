/// <reference types="vite/client" />

/** True only in the claude.ai Artifact build: routes live in memory instead of location.hash. */
declare const __MEMORY_ROUTER__: boolean;

/** True in the demo builds (the claude.ai Artifact): a pretend Warden Chat answers instead of Supabase. */
declare const __DEMO_BACKEND__: boolean;
