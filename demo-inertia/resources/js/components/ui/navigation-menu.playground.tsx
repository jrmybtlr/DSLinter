import { definePlayground } from 'dslinter';
import { navigationMenuPreview } from '@/playground/preview-kits';

export const navigationMenuPlayground = definePlayground({
    id: 'NavigationMenu',
    group: 'ui',
    render: () => navigationMenuPreview(),
});
