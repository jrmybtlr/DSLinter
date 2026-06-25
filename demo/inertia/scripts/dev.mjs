#!/usr/bin/env node
/**
 * Dev orchestration for demo/inertia.
 *
 *   npm run dev          — Laravel + Vite + DSLinter (standalone)
 *   npm run dev:assets   — Vite + DSLinter only (use with `composer run dev`)
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from '../../../packages/dashboard/bin/lib/env.mjs';
import { REPORT_FILE_NAME } from '../../../packages/dashboard/bin/lib/paths.mjs';
import { resolveServePort } from '../../../packages/dashboard/bin/lib/constants.mjs';

const demoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dslinterBin = join(
    demoRoot,
    '..',
    '..',
    'packages',
    'dashboard',
    'bin',
    'dslinter.mjs',
);
const dslinterPort = resolveServePort();
const LARAVEL_HOST = process.env.LARAVEL_SERVE_HOST ?? '127.0.0.1';
const LARAVEL_PORT = Number(process.env.LARAVEL_SERVE_PORT ?? '8000');
const assetsOnly =
    process.argv.includes('--assets-only') ||
    readEnv('DEV_ASSETS_ONLY') === '1';

if (!existsSync(dslinterBin)) {
    process.stderr.write(
        'dslinter: run `pnpm install` from the repo root first (links dslinter package).\n',
    );
    process.exit(1);
}

const reportPath = join(demoRoot, 'public', REPORT_FILE_NAME);

/** @param {number} port */
function portInUse(port) {
    return new Promise((resolve) => {
        const socket = createConnection({ port, host: '127.0.0.1' });
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => resolve(false));
    });
}

const dslinterCmd = `${process.execPath} ${dslinterBin} . --watch --serve ${dslinterPort} --output ${reportPath}`;

/** @type {string[]} */
const commands = ['npm run dev:vite-only', dslinterCmd];

if (!assetsOnly) {
    commands.unshift(
        `php artisan serve --host=${LARAVEL_HOST} --port=${LARAVEL_PORT}`,
    );
}

/** @type {string[]} */
const names = assetsOnly ? ['vite', 'dslinter'] : ['laravel', 'vite', 'dslinter'];

async function main() {
    if (!assetsOnly && (await portInUse(LARAVEL_PORT))) {
        process.stderr.write(
            `\nPort ${LARAVEL_PORT} is already in use — skipping \`artisan serve\`.\n` +
                `Open http://127.0.0.1:${LARAVEL_PORT}/ (or use \`npm run dev:assets\` with \`composer run dev\`).\n\n`,
        );
        commands.shift();
        names.shift();
    }

    if (assetsOnly) {
        process.stderr.write(
            `\ndemo/inertia dev:assets (Vite + DSLinter — Laravel from \`composer run dev\`)\n` +
                `  App (composer)  http://127.0.0.1:${LARAVEL_PORT}/\n` +
                `  DSLinter        scanner + SSE on :${dslinterPort}\n` +
                `  Pages           /components  /governance\n\n`,
        );
    } else {
        process.stderr.write(
            `\ndemo/inertia dev\n` +
                `  Laravel     http://${LARAVEL_HOST}:${LARAVEL_PORT}/\n` +
                `  Vite        (HMR — check terminal for port)\n` +
                `  DSLinter    scanner + SSE on :${dslinterPort}\n` +
                `  Pages       /components  /governance\n\n`,
        );
    }

    const child = spawn(
        'npx',
        [
            'concurrently',
            '-c',
            names.length === 3 ? 'blue,magenta,green' : 'magenta,green',
            '--names',
            names.join(','),
            ...commands,
        ],
        {
            cwd: demoRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                DSLINTER_QUIET: '1',
            },
        },
    );

    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.on(sig, () => {
            if (!child.killed) child.kill(sig);
        });
    }

    child.on('exit', (code) => {
        process.exit(code ?? 0);
    });
}

main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
});
