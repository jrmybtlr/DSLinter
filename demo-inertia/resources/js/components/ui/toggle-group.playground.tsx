import { definePlayground } from 'dslinter';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export const toggleGroupPlayground = definePlayground(() => (
        <ToggleGroup type="single" defaultValue="left">
            <ToggleGroupItem value="left" aria-label="Align left">
                Left
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center">
                Center
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right">
                Right
            </ToggleGroupItem>
        </ToggleGroup>
));
