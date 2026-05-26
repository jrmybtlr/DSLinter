import { definePlayground } from 'dslinter';
import { collapsiblePreview } from '@/playground/preview-kits';

export const collapsiblePlayground = definePlayground({
    id: 'Collapsible',
    group: 'ui',
    controls: [
        {
            key: 'triggerLabel',
            label: 'Trigger label',
            type: 'string',
            default: 'Toggle details',
        },
        {
            key: 'content',
            label: 'Content',
            type: 'string',
            default: 'Collapsible content revealed when expanded.',
        },
    ],
    render: (values) =>
        collapsiblePreview({
            triggerLabel: String(values.triggerLabel ?? 'Toggle details'),
            content: String(
                values.content ??
                    'Collapsible content revealed when expanded.',
            ),
        }),
});
