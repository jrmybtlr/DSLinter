import { definePlayground } from 'dslinter';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const selectPlayground = definePlayground(({ placeholder = 'Pick a stack' }) => (
    <Select defaultValue="react">
        <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="react">React</SelectItem>
            <SelectItem value="vue">Vue</SelectItem>
            <SelectItem value="svelte">Svelte</SelectItem>
        </SelectContent>
    </Select>
));
