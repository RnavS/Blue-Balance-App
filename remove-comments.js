import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('./src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Remove full-line single-line comments (e.g. `  // comment text`)
    content = content.replace(/^\s*\/\/.*$/gm, '');

    // Remove JSX block comments (e.g. `{/* comment */}`)
    content = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    // Remove multi-line block comments (e.g. `/* comment */`), being careful not to match too eagerly
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    // Clean up remaining empty lines specifically left by comments removing
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Comments removed from ' + files.length + ' files.');
