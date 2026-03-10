/**
 * Optimized imports for tree-shaking
 * 
 * This file provides optimized import paths for heavy libraries
 * to ensure better tree-shaking and smaller bundle sizes.
 */

// Re-export only the icons we actually use from lucide-react
// This prevents bundling the entire icon library
export {
  // Common icons
  Send,
  Paperclip,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Settings,
  Menu,
  MoreVertical,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  File,
  Database,
  Table,
  BarChart,
  LineChart,
  PieChart,
  Code,
  Terminal,
  Zap,
  Clock,
  Calendar,
  User,
  Users,
  MessageSquare,
  Eye,
  EyeOff,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// Re-export commonly used Radix UI components
// These are already tree-shakeable but we centralize them here
export { Root as DialogRoot, Trigger as DialogTrigger, Content as DialogContent, Title as DialogTitle, Description as DialogDescription } from '@radix-ui/react-dialog';
export { Root as DropdownRoot, Trigger as DropdownTrigger, Content as DropdownContent, Item as DropdownItem } from '@radix-ui/react-dropdown-menu';
export { Root as TooltipRoot, Trigger as TooltipTrigger, Content as TooltipContent, Provider as TooltipProvider } from '@radix-ui/react-tooltip';
export { Root as ScrollAreaRoot, Viewport as ScrollAreaViewport, Scrollbar as ScrollAreaScrollbar } from '@radix-ui/react-scroll-area';
export { Root as TabsRoot, List as TabsList, Trigger as TabsTrigger, Content as TabsContent } from '@radix-ui/react-tabs';
