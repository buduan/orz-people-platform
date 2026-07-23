/**
 * @typedef {{ label: string, to: string }} PanelNavItem
 * @typedef {{ label: string, items: PanelNavItem[] }} PanelNavGroup
 */

const PANEL_PREFIX = '/panel/';

const humanize = (segment) => segment.charAt(0).toUpperCase() + segment.slice(1);

const metaTitle = (route) => {
  const title = route.meta?.title;
  return typeof title === 'string' && title ? title : undefined;
};

/**
 * Build grouped panel sidebar navigation from vue-router route records.
 *
 * - Groups are the second-level directories under `pages/panel`.
 * - A group's label comes from the `title` meta of the directory's
 *   `index.vue` route; the index route itself is hidden from the items.
 * - Item labels come from each page's `title` meta.
 * - Only files directly inside a second-level directory are listed.
 *
 * @param {{ path: string, meta?: Record<string, unknown> }[]} routes
 * @returns {PanelNavGroup[]}
 */
export function buildPanelNavGroups(routes) {
  /** @type {Map<string, PanelNavGroup>} */
  const groups = new Map();

  const ensureGroup = (key) => {
    let group = groups.get(key);
    if (!group) {
      group = { label: humanize(key), items: [] };
      groups.set(key, group);
    }
    return group;
  };

  routes.forEach((route) => {
    if (!route.path.startsWith(PANEL_PREFIX)) return;

    const segments = route.path.slice(PANEL_PREFIX.length).split('/').filter(Boolean);

    if (segments.length === 1) {
      const group = ensureGroup(segments[0]);
      group.label = metaTitle(route) ?? group.label;
    } else if (segments.length === 2) {
      const [key, page] = segments;
      ensureGroup(key).items.push({
        label: metaTitle(route) ?? humanize(page),
        to: route.path,
      });
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
