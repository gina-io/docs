// Remark plugin — injects a DocMeta component into every doc page.
// Runs at build time on all .md / .mdx files under /docs/.
// Reads `level` and `prereqs` from frontmatter (file.data.frontMatter).

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
    const frontMatter = file.data?.frontMatter ?? {};
    const level = frontMatter.level ?? null;
    const prereqs = Array.isArray(frontMatter.prereqs) ? frontMatter.prereqs : null;

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
      value: "import DocMeta from '@site/src/components/DocMeta';",
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [{
            type: 'ImportDeclaration',
            specifiers: [{
              type: 'ImportDefaultSpecifier',
              local: { type: 'Identifier', name: 'DocMeta' },
            }],
            source: {
              type: 'Literal',
              value: '@site/src/components/DocMeta',
              raw: "'@site/src/components/DocMeta'",
            },
          }],
        },
      },
    };

    // Build JSX attributes — minutes is always present; level and prereqs are optional
    const attributes = [
      {
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
      },
    ];

    if (level) {
      // level is a plain string — pass as a JSX string attribute value
      attributes.push({
        type: 'mdxJsxAttribute',
        name: 'level',
        value: level,
      });
    }

    if (prereqs) {
      // prereqs is an array — pass as an expression attribute with an ArrayExpression
      attributes.push({
        type: 'mdxJsxAttribute',
        name: 'prereqs',
        value: {
          type: 'mdxJsxAttributeValueExpression',
          value: JSON.stringify(prereqs),
          data: {
            estree: {
              type: 'Program',
              sourceType: 'module',
              body: [{
                type: 'ExpressionStatement',
                expression: {
                  type: 'ArrayExpression',
                  elements: prereqs.map((item) => ({
                    type: 'Literal',
                    value: item,
                    raw: JSON.stringify(item),
                  })),
                },
              }],
            },
          },
        },
      });
    }

    // JSX element node — <DocMeta minutes={N} [level="..."] [prereqs={[...]}] />
    const jsxNode = {
      type: 'mdxJsxFlowElement',
      name: 'DocMeta',
      attributes,
      children: [],
    };

    // Insert import at position 0, then DocMeta at pos+1 (accounting for the import)
    const alreadyImported = tree.children.some(
      (n) => n.type === 'mdxjsEsm' && (n.value ?? '').includes('DocMeta'),
    );
    if (!alreadyImported) {
      tree.children.splice(0, 0, importNode);
      pos += 1;
    }
    tree.children.splice(pos, 0, jsxNode);
  };
}
