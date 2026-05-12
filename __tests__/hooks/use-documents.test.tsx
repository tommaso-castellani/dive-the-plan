import { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { trpc } from '@/lib/trpc/client';

import { useDocuments } from '@/hooks/use-documents';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: vi.fn(),
  }),
}));

const mockInvalidate = vi.fn();
const mockFetch = vi.fn();
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    documents: {
      list: {
        useQuery: vi.fn(),
      },
      upload: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
    useUtils: () => ({
      documents: {
        list: {
          invalidate: mockInvalidate,
        },
        getDownloadUrl: {
          fetch: mockFetch,
        },
      },
    }),
  },
}));

describe('useDocuments', () => {
  let queryClient: QueryClient;

  const mockDocuments = [
    {
      id: 'doc_1',
      userId: 'user_123',
      displayName: 'Technical Specification.pdf',
      mimeType: 'application/pdf',
      sizeBytes: '2048000',
      storageUrl: 'https://example.com/docs/tech-spec.pdf',
      status: 'ready' as const,
      documentResourceName: null,
      fileSearchStoreName: null,
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-01-15'),
    },
    {
      id: 'doc_2',
      userId: 'user_123',
      displayName: 'User Manual.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: '1536000',
      storageUrl: 'https://example.com/docs/user-manual.docx',
      status: 'ready' as const,
      documentResourceName: null,
      fileSearchStoreName: null,
      createdAt: new Date('2025-01-20'),
      updatedAt: new Date('2025-01-20'),
    },
  ];

  const mockDocumentsData = {
    documents: mockDocuments,
    total: 2,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  const defaultOptions = {
    page: 1,
    pageSize: 20,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Setup default query mocks (needed for most tests)
    (trpc.documents.list.useQuery as Mock).mockReturnValue({
      data: mockDocumentsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Setup default mutation mocks (needed since the hook returns them)
    (trpc.documents.upload.useMutation as Mock).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    (trpc.documents.delete.useMutation as Mock).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch documents successfully', async () => {
    const { result } = renderHook(() => useDocuments(defaultOptions), { wrapper });

    await waitFor(() => {
      expect(result.current.documents).toEqual(mockDocuments);
      expect(result.current.total).toBe(2);
      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(20);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should upload document successfully', async () => {
    const mockNewDocument = {
      id: 'doc_new',
      userId: 'user_123',
      displayName: 'New Document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: '12',
      storageUrl: 'https://example.com/docs/new-document.pdf',
      status: 'in_progress' as const,
      documentResourceName: null,
      fileSearchStoreName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMutateAsync = vi.fn().mockImplementation(() => {
      const options = (trpc.documents.upload.useMutation as Mock).mock.calls[0][0];
      options.onSuccess(mockNewDocument);
    });

    (trpc.documents.upload.useMutation as Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    const { result } = renderHook(() => useDocuments(defaultOptions), { wrapper });

    const mockFile = new File(['test content'], 'new-document.pdf', {
      type: 'application/pdf',
    });

    await result.current.uploadDocument({
      file: mockFile,
      displayName: 'New Document.pdf',
      fileData: 'base64encodedcontent',
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      displayName: 'New Document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: mockFile.size.toString(),
      fileData: 'base64encodedcontent',
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Uploading',
      description: 'Document uploaded to storage, indexing in progress...',
    });

    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('should show destructive toast on upload document error', async () => {
    (trpc.documents.upload.useMutation as Mock).mockReturnValue({
      mutateAsync: vi.fn().mockImplementation(() => {
        const options = (trpc.documents.upload.useMutation as Mock).mock.calls[0][0];
        options.onError(new Error('Failed to upload document'));
      }),
      isPending: false,
    });

    const { result } = renderHook(() => useDocuments(defaultOptions), { wrapper });

    const mockFile = new File(['test content'], 'new-document.pdf', {
      type: 'application/pdf',
    });

    await result.current.uploadDocument({
      file: mockFile,
      displayName: 'New Document.pdf',
      fileData: 'base64encodedcontent',
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to upload document',
      variant: 'destructive',
    });
  });

  it('should delete document successfully', async () => {
    const mockMutate = vi.fn().mockImplementation(() => {
      const options = (trpc.documents.delete.useMutation as Mock).mock.calls[0][0];
      options.onSuccess();
    });

    (trpc.documents.delete.useMutation as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useDocuments(defaultOptions), { wrapper });

    result.current.deleteDocument({ id: 'doc_1' });

    expect(mockMutate).toHaveBeenCalledWith({ id: 'doc_1' });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Document deleted successfully',
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('should show destructive toast on delete document error', async () => {
    (trpc.documents.delete.useMutation as Mock).mockReturnValue({
      mutate: vi.fn().mockImplementation(() => {
        const options = (trpc.documents.delete.useMutation as Mock).mock.calls[0][0];
        options.onError(new Error('Failed to delete document'));
      }),
      isPending: false,
    });

    const { result } = renderHook(() => useDocuments(defaultOptions), { wrapper });

    result.current.deleteDocument({ id: 'doc_1' });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to delete document',
      variant: 'destructive',
    });
  });

  it('should handle server-side search', () => {
    const searchQuery = 'Technical';

    (trpc.documents.list.useQuery as Mock).mockReturnValue({
      data: { ...mockDocumentsData, documents: [mockDocuments[0]] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useDocuments({ ...defaultOptions, searchQuery }), {
      wrapper,
    });

    expect(trpc.documents.list.useQuery).toHaveBeenCalledWith(
      {
        searchQuery,
        page: 1,
        pageSize: 20,
      },
      expect.any(Object)
    );
    expect(result.current.documents).toHaveLength(1);
  });

  it('should handle pagination', () => {
    (trpc.documents.list.useQuery as Mock).mockReturnValue({
      data: { ...mockDocumentsData, page: 2, totalPages: 5 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useDocuments({ page: 2, pageSize: 10 }), { wrapper });

    expect(trpc.documents.list.useQuery).toHaveBeenCalledWith(
      {
        searchQuery: undefined,
        page: 2,
        pageSize: 10,
      },
      expect.any(Object)
    );

    expect(result.current.page).toBe(2);
    expect(result.current.totalPages).toBe(5);
  });

  it('should handle combined filters (search + pagination)', () => {
    const customOptions = {
      searchQuery: 'Manual',
      page: 2,
      pageSize: 10,
    };

    renderHook(() => useDocuments(customOptions), { wrapper });

    expect(trpc.documents.list.useQuery).toHaveBeenCalledWith(
      {
        searchQuery: 'Manual',
        page: 2,
        pageSize: 10,
      },
      expect.any(Object)
    );
  });
});
