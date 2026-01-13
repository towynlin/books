import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Book } from '../types/book';
import { DraggableBookCard } from './DraggableBookCard';
import { useReorderNextUp } from '../hooks/useBooks';

interface DraggableBookListProps {
  books: Book[];
}

export function DraggableBookList({ books: initialBooks }: DraggableBookListProps) {
  const [books, setBooks] = useState(initialBooks);
  const reorderNextUp = useReorderNextUp();

  // Update local state when initialBooks changes (from server)
  useEffect(() => {
    if (!reorderNextUp.isPending) {
      setBooks(initialBooks);
    }
  }, [initialBooks, reorderNextUp.isPending]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = books.findIndex((book) => book.id === active.id);
      const newIndex = books.findIndex((book) => book.id === over.id);

      const newBooks = arrayMove(books, oldIndex, newIndex);
      setBooks(newBooks);

      // Send the new order to the backend
      const bookIds = newBooks.map((book) => book.id);
      reorderNextUp.mutate(bookIds);
    }
  };

  return (
    <div>
      <div className="mb-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <span className="font-medium">💡 Tip:</span> Drag the handle on the left of each book to reorder your reading list
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={books.map((book) => book.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
            {books.map((book) => (
              <DraggableBookCard key={book.id} book={book} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
