import { BookOpen, FolderGit2, LayoutGrid, Layers } from 'lucide-react';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

export const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Components',
        href: '/components',
        icon: Layers,
    },
];

export const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: FolderGit2,
        external: true,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
        external: true,
    },
];

/** External links shown in the header layout (same as footer nav) */
export const rightNavItems: NavItem[] = footerNavItems;
