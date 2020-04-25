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

export function extractFirstImage(source: string) {
  const parsed = parser.parse(source);
  return findImage(parsed);
}
