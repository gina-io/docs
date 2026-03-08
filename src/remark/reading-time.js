// Remark plugin — injects a ReadingTimeBadge component into every doc page.
// Runs at build time on all .md / .mdx files under /docs/.

function countWords(nodes) {
  let n = 0;
  for (const node of nodes ?? []) {
    if (node.type === 'text' || node.type === 'inlineCode') {
      n += (node.value ?? '').trim().split(/\s+/).filter(Boolean).length;
    }
    if (node.children) n += countWords(node.children);
  }
  return n;
}

export default function readingTimePlugin() {
  return (tree, file) => {
    const fp = String(file.history?.[0] ?? file.path ?? '');
    if (!fp.includes('/docs/')) return;

    const minutes = Math.max(1, Math.round(countWords(tree.children) / 200));

    // Find insertion point: after the first h1.
    // Docusaurus converts `# Title` to mdxJsxFlowElement{name:"header"} before
    // remark plugins run, so we must match both the raw heading node and the
    // already-converted JSX wrapper.
    let pos = 0;
    for (let i = 0; i < tree.children.length; i++) {
      const n = tree.children[i];
      if (
        (n.type === 'heading' && n.depth === 1) ||
        (n.type === 'mdxJsxFlowElement' && n.name === 'header')
      ) {
        pos = i + 1;
        break;
      }
    }

    // Import node — inlined ESTree AST required by MDX v3
    const importNode = {
      type: 'mdxjsEsm',
      value: "import ReadingTimeBadge from '@site/src/components/ReadingTimeBadge';",
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [{
            type: 'ImportDeclaration',
            specifiers: [{
              type: 'ImportDefaultSpecifier',
              local: { type: 'Identifier', name: 'ReadingTimeBadge' },
            }],
            source: {
              type: 'Literal',
              value: '@site/src/components/ReadingTimeBadge',
              raw: "'@site/src/components/ReadingTimeBadge'",
            },
          }],
        },
      },
    };

    // JSX element node — <ReadingTimeBadge minutes={N} />
    const jsxNode = {
      type: 'mdxJsxFlowElement',
      name: 'ReadingTimeBadge',
      attributes: [{
        type: 'mdxJsxAttribute',
        name: 'minutes',
        value: {
          type: 'mdxJsxAttributeValueExpression',
          value: String(minutes),
          data: {
            estree: {
              type: 'Program',
              sourceType: 'module',
              body: [{
                type: 'ExpressionStatement',
                expression: { type: 'Literal', value: minutes, raw: String(minutes) },
              }],
            },
          },
        },
      }],
      children: [],
    };

    // Insert import at position 0, then badge at pos+1 (accounting for the import)
    const alreadyImported = tree.children.some(
      (n) => n.type === 'mdxjsEsm' && (n.value ?? '').includes('ReadingTimeBadge'),
    );
    if (!alreadyImported) {
      tree.children.splice(0, 0, importNode);
      pos += 1;
    }
    tree.children.splice(pos, 0, jsxNode);
  };
}
