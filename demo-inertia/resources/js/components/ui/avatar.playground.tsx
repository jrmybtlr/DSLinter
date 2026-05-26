import { definePlayground } from 'dslinter';
import { avatarPreview } from '@/playground/preview-kits';

export const avatarPlayground = definePlayground({
    id: 'Avatar',
    group: 'ui',
    render: () => avatarPreview(),
});
