import { definePlayground } from 'dslinter';
import { alertPreview } from '@/playground/preview-kits';

export const alertPlayground = definePlayground({
    id: 'Alert',
    group: 'ui',
    controls: [
        {
            key: 'title',
            label: 'Title',
            type: 'string',
            default: 'Alert',
        },
        {
            key: 'description',
            label: 'Description',
            type: 'string',
            default: 'Default alert for status messages and inline notices.',
        },
    ],
    render: (values) =>
        alertPreview({
            title: String(values.title ?? 'Alert'),
            description: String(
                values.description ??
                    'Default alert for status messages and inline notices.',
            ),
        }),
});
