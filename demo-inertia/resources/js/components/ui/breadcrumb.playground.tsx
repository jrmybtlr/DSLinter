import { definePlayground } from 'dslinter';
import { breadcrumbPreview } from '@/playground/preview-kits';

export const breadcrumbPlayground = definePlayground({
    id: 'Breadcrumb',
    group: 'ui',
    render: () => breadcrumbPreview(),
});
