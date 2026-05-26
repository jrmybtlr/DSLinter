import { definePlayground } from 'dslinter';
import { sidebarPreview } from '@/playground/preview-kits';

export const sidebarPlayground = definePlayground({
    id: 'Sidebar',
    group: 'ui',
    render: () => sidebarPreview(),
});
