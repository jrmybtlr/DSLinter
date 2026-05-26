import { definePlayground } from 'dslinter';
import { toggleGroupPreview } from '@/playground/preview-kits';

export const toggleGroupPlayground = definePlayground({
    id: 'ToggleGroup',
    group: 'ui',
    render: () => toggleGroupPreview(),
});
