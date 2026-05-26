import { definePlayground } from 'dslinter';
import { sheetPreview } from '@/playground/preview-kits';

export const sheetPlayground = definePlayground({
    id: 'Sheet',
    group: 'ui',
    controls: [
        {
            key: 'triggerLabel',
            label: 'Trigger label',
            type: 'string',
            default: 'Open sheet',
        },
        {
            key: 'title',
            label: 'Title',
            type: 'string',
            default: 'Sheet',
        },
    ],
    render: (values) =>
        sheetPreview({
            triggerLabel: String(values.triggerLabel ?? 'Open sheet'),
            title: String(values.title ?? 'Sheet'),
        }),
});
