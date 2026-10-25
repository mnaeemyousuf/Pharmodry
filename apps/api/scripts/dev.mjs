// Development runner: loads .env and starts the compiled API with Node's watch mode.
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['--env-file-if-exists=.env', '--enable-source-maps', '--watch-path=dist', 'dist/main.js'], { stdio: 'inherit' });
const tsc = spawn(process.execPath, ['../../node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { stdio: 'ignore' });
const stop = () => { child.kill(); tsc.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
