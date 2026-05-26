import { definePlayground } from 'dslinter';
import { menuPreview } from '@/playground/preview-kits';

export const dropdownMenuPlayground = definePlayground({
    id: 'DropdownMenu',
    group: 'ui',
    controls: [
        {
            key: 'triggerLabel',
            label: 'Trigger label',
            type: 'string',
            default: 'Open menu',
        },
        {
            key: 'itemOne',
            label: 'Item 1',
            type: 'string',
            default: 'Profile',
        },
        {
            key: 'itemTwo',
            label: 'Item 2',
            type: 'string',
            default: 'Settings',
        },
        {
            key: 'itemThree',
            label: 'Item 3',
            type: 'string',
            default: 'Sign out',
        },
    ],
    render: (values) =>
        menuPreview({
            triggerLabel: String(values.triggerLabel ?? 'Open menu'),
            items: [
                { label: String(values.itemOne ?? 'Profile') },
                { label: String(values.itemTwo ?? 'Settings') },
                { label: String(values.itemThree ?? 'Sign out') },
            ],
        }),
});
