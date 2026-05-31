import { definePlaygroundFromKit } from 'dslinter';
import { UserInfo } from '@/components/user-info';
import type { User } from '@/types';

const sampleUser: User = {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    email_verified_at: null,
    created_at: '',
    updated_at: '',
};

export const userInfoPlayground = definePlaygroundFromKit({
    controls: [{ key: 'showEmail', type: 'boolean', default: false }],
    kit: ({ showEmail }) => (
        <UserInfo user={sampleUser} showEmail={showEmail} />
    ),
});
