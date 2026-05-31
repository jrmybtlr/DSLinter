import { definePlaygroundFromKit } from 'dslinter';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export const tooltipPlayground = definePlaygroundFromKit({
    controls: {
        triggerLabel: 'Tooltip',
        content: 'Helpful hint on hover',
    },
    kit: ({ triggerLabel, content }) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost">{triggerLabel}</Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{content}</p>
            </TooltipContent>
        </Tooltip>
    ),
});
