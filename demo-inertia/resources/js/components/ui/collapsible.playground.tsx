import { definePlaygroundFromKit } from 'dslinter';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

export const collapsiblePlayground = definePlaygroundFromKit({
    controls: ['triggerLabel', 'content'],
    kit: ({ triggerLabel, content }) => (
        <Collapsible className="w-[260px] space-y-2">
            <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                    {triggerLabel}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground text-sm">
                {content}
            </CollapsibleContent>
        </Collapsible>
    ),
});
