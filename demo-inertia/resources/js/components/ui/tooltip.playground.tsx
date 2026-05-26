import { definePlayground } from 'dslinter';
import { tooltipPreview } from '@/playground/preview-kits';

export const tooltipPlayground = definePlayground({
    id: 'Tooltip',
    group: 'ui',
    controls: [
        {
            key: 'triggerLabel',
            label: 'Trigger label',
            type: 'string',
            default: 'Tooltip',
        },
        {
            key: 'content',
            label: 'Content',
            type: 'string',
            default: 'Helpful hint on hover',
        },
    ],
    render: (values) =>
        tooltipPreview({
            triggerLabel: String(values.triggerLabel ?? 'Tooltip'),
            content: String(values.content ?? 'Helpful hint on hover'),
        }),
});
