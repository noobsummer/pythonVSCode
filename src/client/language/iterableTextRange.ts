import { ITextRange, ITextRangeCollection } from './types';

export class IterableTextRange<T extends ITextRange> implements Iterable<T>{
    constructor(private textRangeCollection: ITextRangeCollection<T>) {
    }
    public [Symbol.iterator](): Iterator<T> {
        let index = 0;

        return {
            next(): IteratorResult<T> {
                if (index < this.textRangeCollection.length) {
                    return {
                        done: false,
                        value: this.textRangeCollection[index += 1]
                    };
                } else {
                    return {
                        done: true,
                        value: undefined
                    };
                }
            }
        };
    }
}
