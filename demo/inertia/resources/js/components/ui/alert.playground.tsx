import type { ComponentProps } from 'react';
import { definePlayground } from 'dslinter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AlertKitArgs = {
    title: string;
    description: string;
    variant: NonNullable<ComponentProps<typeof Alert>['variant']>;
};

export const alertPlayground = definePlayground<AlertKitArgs>(
    ({ title, description, variant }) => (
        <Alert className="max-w-md" variant={variant}>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    ),
);
