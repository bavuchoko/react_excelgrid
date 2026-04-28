export function computeRowNumber(args: {
    pageNumber?: number;
    pageSize?: number;
    pageSizeAlt?: number;
    totalElements?: number;
    rowIndexOnPage: number;
    fallbackPageSize: number;
}) {
    const pageNumber = args.pageNumber ?? 0;
    const pageSize = args.pageSize ?? args.pageSizeAlt ?? args.fallbackPageSize ?? 0;
    const total = args.totalElements ?? 0;
    const globalIndex = pageNumber * pageSize + args.rowIndexOnPage;
    return total > 0 ? (total - globalIndex) : (args.rowIndexOnPage + 1);
}

