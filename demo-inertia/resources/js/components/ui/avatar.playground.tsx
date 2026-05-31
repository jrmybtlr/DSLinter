import { definePlayground } from 'dslinter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const avatarPlayground = definePlayground(() => (
        <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
            <AvatarFallback>SC</AvatarFallback>
        </Avatar>
));
