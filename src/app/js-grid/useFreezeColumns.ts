import {useEffect, useState} from "react";

export function useFreezeColumns(columnsLength: number) {
    const [freezeUntilIndex, setFreezeUntilIndex] = useState<number | null>(null);

    useEffect(() => {
        setFreezeUntilIndex((prev) => {
            if (prev == null) return prev;
            const max = columnsLength - 1;
            return prev > max ? max : prev;
        });
    }, [columnsLength]);

    return { freezeUntilIndex, setFreezeUntilIndex };
}

