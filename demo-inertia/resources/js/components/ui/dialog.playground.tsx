import { definePlayground } from 'dslinter';
import { dialogPreview } from '@/playground/preview-kits';

export const dialogPlayground = definePlayground({
    id: 'Dialog',
    group: 'ui',
    controls: [
        {
            key: 'triggerLabel',
            label: 'Trigger label',
            type: 'string',
            default: 'Open dialog',
        },
        {
            key: 'title',
            label: 'Title',
            type: 'string',
            default: 'Dialog',
        },
        {
            key: 'description',
            label: 'Description',
            type: 'string',
            default: 'Modal content built with Radix Dialog primitives.',
        },
    ],
    render: (values) =>
        dialogPreview({
            triggerLabel: String(values.triggerLabel ?? 'Open dialog'),
            title: String(values.title ?? 'Dialog'),
            description: String(
                values.description ??
                    'Modal content built with Radix Dialog primitives.',
            ),
        }),
});
