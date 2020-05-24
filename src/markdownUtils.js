// @flow
import unified from 'unified';
import markdown from 'remark-parse';

const parser = unified().use(markdown, {commonmark: true});

type ImageNode = {type: 'image', url: string};

type Node = ImageNode | {type: string, children?: Array<Node>};

function findImage(node: Node): ?ImageNode {
  if (node.type === 'image') {
    // $FlowFixMe
    return node;
  } else if (node.children) {
    for (let i = 0; i <= node.children.length - 1; i += 1) {
      const n = node.children[0];
      const img = findImage(n);
      if (img) {
        return img;
      }
    }
  }
}

function findFirstParagraphText(node: Node): ?string {
  if (node.type === 'text') {
    // $FlowFixMe
    return node.value;
  } else if (node.children) {
    for (let i = 0; i <= node.children.length - 1; i += 1) {
      const n = node.children[i];
      const text = findFirstParagraphText(n);

      if (text) {
        return text;
      }
    }
  }
}

export function extractFirstImage(source: string) {
  const parsed = parser.parse(source);
  return findImage(parsed);
}

export function extractFirstText(source: string) {
  const parsed = parser.parse(source);
  return findFirstParagraphText(parsed);
}

export function unwrapBlocks(node) {
  return {
    ...node,
    children: node.children.map(n =>
      n.children && n.children[0].type === 'image' ? n.children[0] : n,
    ),
  };
}
