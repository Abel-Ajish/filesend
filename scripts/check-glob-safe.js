const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const REQUIRED_GLOB_VERSION_MAJOR = 10;
const REQUIRED_GLOB_VERSION_MINOR = 5;
const FORBIDDEN_PATTERNS = [
  /glob\s+(-c|--cmd)/,
  /node\s+.*bin\.mjs\s+-c/,
  /foregroundChild.*shell:\s*true/
];

function checkLockfile() {
  console.log('Checking package-lock.json for vulnerable glob versions...');
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.warn('No package-lock.json found. Skipping lockfile check.');
    return;
  }

  const lockfile = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  
  function checkDependencies(deps, pathStack = []) {
    if (!deps) return;
    
    for (const [name, info] of Object.entries(deps)) {
      if (name === 'glob') {
        const version = info.version;
        // Check if version is valid semver-ish
        const match = version.match(/^(\d+)\.(\d+)\./);
        if (match) {
          const major = parseInt(match[1], 10);
          const minor = parseInt(match[2], 10);
          
          if (major < REQUIRED_GLOB_VERSION_MAJOR || 
              (major === REQUIRED_GLOB_VERSION_MAJOR && minor < REQUIRED_GLOB_VERSION_MINOR) ||
              (major === 11 && minor < 1)) {
            console.error(`ERROR: Vulnerable glob version found: ${version} at ${pathStack.join(' > ')} > glob`);
            process.exitCode = 1;
          }
        }
      }
      
      if (info.dependencies) {
        checkDependencies(info.dependencies, [...pathStack, name]);
      }
    }
  }

  // Check packages (npm v7+ format)
  if (lockfile.packages) {
     for (const [key, pkg] of Object.entries(lockfile.packages)) {
         if (key.endsWith('node_modules/glob')) {
             const version = pkg.version;
             const match = version.match(/^(\d+)\.(\d+)\./);
             if (match) {
                 const major = parseInt(match[1], 10);
                 const minor = parseInt(match[2], 10);
                 if (major < REQUIRED_GLOB_VERSION_MAJOR || 
                     (major === REQUIRED_GLOB_VERSION_MAJOR && minor < REQUIRED_GLOB_VERSION_MINOR) ||
                     (major === 11 && minor < 1)) {
                      console.error(`ERROR: Vulnerable glob version found in packages: ${version} in ${key}`);
                      process.exitCode = 1;
                 }
             }
         }
     }
  } else {
      // Legacy or flattened dependencies
      checkDependencies(lockfile.dependencies);
  }
}

function checkCodebase() {
  console.log('Scanning codebase for unsafe glob CLI usage...');
  // Simple grep via git grep or recursive search
  try {
    // Exclude this script itself from the search
    const scriptName = path.basename(__filename);
    const output = execSync(`git grep -nE "glob.*(-c|--cmd)|node.*bin\\.mjs.*-c|foregroundChild.*shell:.*true" -- . ":!scripts/${scriptName}"`, { encoding: 'utf8', cwd: path.join(__dirname, '..') });
    if (output.trim()) {
        console.error('ERROR: Unsafe glob CLI usage found:');
        console.error(output);
        process.exitCode = 1;
    }
  } catch (e) {
    // git grep returns 1 if not found, which is good
    if (e.status !== 1) {
        // If it's not "not found" (1), it's a real error
        console.warn('Warning: Could not run git grep used to scan files. Skipping source scan.', e.message);
    }
  }
}

checkLockfile();
checkCodebase();

if (process.exitCode) {
    console.error('FAILED: Security check failed.');
} else {
    console.log('SUCCESS: No vulnerable glob versions or unsafe CLI usage found.');
}
