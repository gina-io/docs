'use strict';
/**
 * sync-versions.js
 *
 * Reads the current gina, @rhinostone/swig, @rhinostone/swig-twig,
 * @rhinostone/swig-jinja2, and @rhinostone/swig-django package versions and
 * patches the `ginaVersion` / `swigVersion` / `twigVersion` / `jinjaVersion` /
 * `djangoVersion` constants in docusaurus.config.js so the version badges in
 * the docs sidebar always reflect the latest stable release.
 *
 * Resolution order for each package (first version found wins):
 *   1. <PKG>_PATH env var    — explicit worktree override (GINA_PATH, SWIG_PATH,
 *                              SWIG_TWIG_PATH, SWIG_JINJA2_PATH, SWIG_DJANGO_PATH)
 *   2. ~/.npm-global install — user-local global install
 *   3. ~/Sites/gina/<name>   — local worktree sibling (swig-twig / swig-jinja2 /
 *                              swig-django live under ~/Sites/gina/swig/packages/)
 *   4. npm registry          — `npm view <pkg> dist-tags.latest`. CI deploy
 *                              builds have no local worktree, so this is what
 *                              keeps the production badges current without a
 *                              docs-side commit per release.
 *   5. require.resolve       — docs repo node_modules (likely stale; offline
 *                              last resort)
 *
 * Pre-release versions (containing `-`) are skipped — the docs site
 * advertises stable releases only.
 *
 * Usage:
 *   node scripts/sync-versions.js
 *
 * Set <PKG>_PATH to point at a specific worktree when working across branches:
 *   GINA_PATH=~/Sites/gina/gina-dev                     npm start
 *   SWIG_PATH=~/Sites/gina/swig                         npm start
 *   SWIG_TWIG_PATH=~/Sites/gina/swig/packages/swig-twig npm start
 *   SWIG_JINJA2_PATH=~/Sites/gina/swig/packages/swig-jinja2 npm start
 *   SWIG_DJANGO_PATH=~/Sites/gina/swig/packages/swig-django npm start
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.resolve(__dirname, '..', 'docusaurus.config.js');

function readPkgVersion(pkgRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version || null;
    } catch (e) {
        return null;
    }
}

function registryLatest(pkgName) {
    try {
        var out = execSync('npm view ' + pkgName + ' dist-tags.latest', {
            encoding: 'utf8',
            timeout: 15000,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        return out || null;
    } catch (e) {
        return null;
    }
}

function syncVersion(opts) {
    var label      = opts.label;
    var configKey  = opts.configKey;
    var pkgName    = opts.pkgName;
    var candidates = opts.candidates.filter(Boolean);

    var version = null;
    var source  = null;

    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(path.join(candidates[i], 'package.json'))) {
            version = readPkgVersion(candidates[i]);
            source  = candidates[i];
            break;
        }
    }

    if (!version) {
        version = registryLatest(pkgName);
        if (version) { source = 'npm registry'; }
    }

    if (!version) {
        try {
            var resolved = path.dirname(require.resolve(pkgName + '/package.json'));
            version = readPkgVersion(resolved);
            source  = resolved;
        } catch (e) {
            // not installed in node_modules either — fall through to the warning
        }
    }

    if (!version) {
        console.warn('[sync-versions] Could not resolve', label, '— set', label.toUpperCase().replace(/-/g, '_') + '_PATH to your worktree.', configKey, 'unchanged.');
        return;
    }

    if (version.indexOf('-') !== -1) {
        console.log('[sync-versions]', configKey, 'skipped — pre-release version', version, 'is not advertised on the docs site.');
        return;
    }

    var src     = fs.readFileSync(CONFIG_PATH, 'utf8');
    var re      = new RegExp('const ' + configKey + " = '[^']*'");
    var patched = src.replace(re, 'const ' + configKey + " = '" + version + "'");

    if (src === patched) {
        console.log('[sync-versions]', configKey, 'already at', version);
    } else {
        fs.writeFileSync(CONFIG_PATH, patched);
        console.log('[sync-versions]', configKey, 'updated to', version, '(from', source + ')');
    }
}

var HOME = process.env.HOME || '';

syncVersion({
    label: 'gina',
    configKey: 'ginaVersion',
    pkgName: 'gina',
    candidates: [
        process.env.GINA_PATH && path.resolve(process.env.GINA_PATH),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', 'gina'),
        path.join(HOME, 'Sites', 'gina', 'gina-dev')
    ]
});

syncVersion({
    label: 'swig',
    configKey: 'swigVersion',
    pkgName: '@rhinostone/swig',
    candidates: [
        process.env.SWIG_PATH && path.resolve(process.env.SWIG_PATH),
        path.join(HOME, 'Sites', 'gina', 'swig'),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', '@rhinostone', 'swig')
    ]
});

syncVersion({
    label: 'swig-twig',
    configKey: 'twigVersion',
    pkgName: '@rhinostone/swig-twig',
    candidates: [
        process.env.SWIG_TWIG_PATH && path.resolve(process.env.SWIG_TWIG_PATH),
        path.join(HOME, 'Sites', 'gina', 'swig', 'packages', 'swig-twig'),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', '@rhinostone', 'swig-twig')
    ]
});

syncVersion({
    label: 'swig-jinja2',
    configKey: 'jinjaVersion',
    pkgName: '@rhinostone/swig-jinja2',
    candidates: [
        process.env.SWIG_JINJA2_PATH && path.resolve(process.env.SWIG_JINJA2_PATH),
        path.join(HOME, 'Sites', 'gina', 'swig', 'packages', 'swig-jinja2'),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', '@rhinostone', 'swig-jinja2')
    ]
});

syncVersion({
    label: 'swig-django',
    configKey: 'djangoVersion',
    pkgName: '@rhinostone/swig-django',
    candidates: [
        process.env.SWIG_DJANGO_PATH && path.resolve(process.env.SWIG_DJANGO_PATH),
        path.join(HOME, 'Sites', 'gina', 'swig', 'packages', 'swig-django'),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', '@rhinostone', 'swig-django')
    ]
});
