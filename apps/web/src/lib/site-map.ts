export interface MapNode {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  readonly children?: readonly MapNode[];
}

export function flattenMap(nodes: readonly MapNode[]): readonly MapNode[] {
  return nodes.flatMap((node) => [node, ...flattenMap(node.children ?? [])]);
}

export function mapHrefs(nodes: readonly MapNode[]): readonly string[] {
  return flattenMap(nodes).map((node) => node.href);
}
