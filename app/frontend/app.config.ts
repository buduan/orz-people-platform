export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate',
    },
    // Override Nuxt UI's default Lucide icon aliases with the Solar
    // line-duotone icon set. These names feed every built-in component
    // (buttons, selects, pagination, breadcrumbs, etc.).
    icons: {
      arrowLeft: 'i-solar-arrow-left-line-duotone',
      arrowRight: 'i-solar-arrow-right-line-duotone',
      check: 'i-solar-check-read-line-duotone',
      chevronDoubleLeft: 'i-solar-double-alt-arrow-left-line-duotone',
      chevronDoubleRight: 'i-solar-double-alt-arrow-right-line-duotone',
      chevronDown: 'i-solar-alt-arrow-down-line-duotone',
      chevronLeft: 'i-solar-alt-arrow-left-line-duotone',
      chevronRight: 'i-solar-alt-arrow-right-line-duotone',
      chevronUp: 'i-solar-alt-arrow-up-line-duotone',
      close: 'i-solar-close-circle-line-duotone',
      ellipsis: 'i-solar-menu-dots-line-duotone',
      external: 'i-solar-arrow-right-up-line-duotone',
      file: 'i-solar-file-line-duotone',
      folder: 'i-solar-folder-line-duotone',
      folderOpen: 'i-solar-folder-open-line-duotone',
      loading: 'i-solar-refresh-line-duotone',
      minus: 'i-solar-minus-circle-line-duotone',
      plus: 'i-solar-add-circle-line-duotone',
      search: 'i-solar-magnifer-line-duotone',
      upload: 'i-solar-upload-line-duotone',
    },
  },
});
