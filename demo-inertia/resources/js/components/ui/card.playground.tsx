import { definePlayground } from 'dslinter';
import { cardPreview } from '@/playground/preview-kits';

export const cardPlayground = definePlayground({
    id: 'Card',
    group: 'ui',
    render: () => cardPreview(),
});
