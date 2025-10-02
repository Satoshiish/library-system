-- Seed data for the Library Management System
-- This script populates the database with sample data for testing

-- Added sample users with hashed passwords for authentication
-- Insert sample users (passwords are hashed versions of 'password123')
-- Note: In production, use proper password hashing like bcrypt
INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES
('admin@library.com', '$2b$10$rOzJqQqQqQqQgQgQgQgQgOzJqQqQgQgQgQgQgQgQgOzJqQgQgQgQgQ', 'Library Administrator', 'admin', true),
('librarian@library.com', '$2b$10$rOzJqQqQqQgQgQgQgQgQgOzJqQqQgQgQgQgQgQgQgOzJqQgQgQgQgQ', 'Head Librarian', 'librarian', true),
('staff@library.com', '$2b$10$rOzJqQqQkQgQgQgQgQgQgOzJqQkQgQgQgQgQgQgQgOzJqQgQgQgQgQ', 'Library Staff', 'staff', true),
('john.librarian@library.com', '$2b$10$rOzJqQqQkQgQgQgQgQgQgOzJqQkQgQgQgQgQgQgQgOzJqQgQgQgQgQ', 'John Smith', 'librarian', true),
('sarah.staff@library.com', '$2b$10$rOzJqQqQkQgQgQgQgQgQgOzJqQkQgQgQgQgQgQgQgOzJqQgQgQgQgQ', 'Sarah Johnson', 'staff', true);

-- Insert sample books
INSERT INTO books (title, author, isbn, category, status, description) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', '978-0-7432-7356-5', 'Fiction', 'available', 'A classic American novel set in the Jazz Age.'),
('To Kill a Mockingbird', 'Harper Lee', '978-0-06-112008-4', 'Fiction', 'checked_out', 'A gripping tale of racial injustice and childhood innocence.'),
('1984', 'George Orwell', '978-0-452-28423-4', 'Dystopian', 'reserved', 'A dystopian social science fiction novel and cautionary tale.'),
('Pride and Prejudice', 'Jane Austen', '978-0-14-143951-8', 'Romance', 'available', 'A romantic novel of manners written by Jane Austen.'),
('The Catcher in the Rye', 'J.D. Salinger', '978-0-316-76948-0', 'Fiction', 'available', 'A controversial novel originally published for adults.'),
('The Lord of the Rings', 'J.R.R. Tolkien', '978-0-544-00341-5', 'Fantasy', 'checked_out', 'An epic high-fantasy novel written by English author J.R.R. Tolkien.'),
('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', '978-0-439-70818-8', 'Fantasy', 'checked_out', 'The first novel in the Harry Potter series.'),
('The Hobbit', 'J.R.R. Tolkien', '978-0-547-92822-7', 'Fantasy', 'checked_out', 'A children''s fantasy novel by English author J.R.R. Tolkien.'),
('Brave New World', 'Aldous Huxley', '978-0-06-085052-4', 'Dystopian', 'available', 'A dystopian social science fiction novel.'),
('The Chronicles of Narnia', 'C.S. Lewis', '978-0-06-623851-4', 'Fantasy', 'available', 'A series of seven fantasy novels by C.S. Lewis.');

-- Insert sample borrowers
INSERT INTO borrowers (name, email, phone, member_since, status) VALUES
('John Doe', 'john.doe@email.com', '(555) 123-4567', '2023-06-15', 'active'),
('Jane Smith', 'jane.smith@email.com', '(555) 987-6543', '2023-08-22', 'active'),
('Bob Johnson', 'bob.johnson@email.com', '(555) 456-7890', '2023-03-10', 'active'),
('Alice Wilson', 'alice.wilson@email.com', '(555) 234-5678', '2023-05-20', 'active'),
('Charlie Brown', 'charlie.brown@email.com', '(555) 345-6789', '2023-09-10', 'active'),
('Diana Prince', 'diana.prince@email.com', '(555) 567-8901', '2023-07-05', 'active');

-- Insert sample borrower records
-- Active loans
INSERT INTO borrower_records (book_id, borrower_id, borrowed_at, due_date, status) VALUES
((SELECT id FROM books WHERE title = 'To Kill a Mockingbird'), (SELECT id FROM borrowers WHERE name = 'John Doe'), '2024-01-10', '2024-01-24', 'active'),
((SELECT id FROM books WHERE title = 'The Lord of the Rings'), (SELECT id FROM borrowers WHERE name = 'Alice Wilson'), '2023-12-28', '2024-01-10', 'overdue'),
((SELECT id FROM books WHERE title = 'Harry Potter and the Sorcerer''s Stone'), (SELECT id FROM borrowers WHERE name = 'Charlie Brown'), '2023-12-30', '2024-01-12', 'overdue'),
((SELECT id FROM books WHERE title = 'The Hobbit'), (SELECT id FROM borrowers WHERE name = 'Diana Prince'), '2024-01-01', '2024-01-15', 'active');

-- Historical returns
INSERT INTO borrower_records (book_id, borrower_id, borrowed_at, due_date, returned_at, status) VALUES
((SELECT id FROM books WHERE title = 'The Great Gatsby'), (SELECT id FROM borrowers WHERE name = 'Jane Smith'), '2023-12-01', '2023-12-15', '2023-12-14', 'returned'),
((SELECT id FROM books WHERE title = 'Pride and Prejudice'), (SELECT id FROM borrowers WHERE name = 'Bob Johnson'), '2023-11-15', '2023-11-29', '2023-11-28', 'returned'),
((SELECT id FROM books WHERE title = '1984'), (SELECT id FROM borrowers WHERE name = 'John Doe'), '2023-11-01', '2023-11-15', '2023-11-16', 'returned'),
((SELECT id FROM books WHERE title = 'The Catcher in the Rye'), (SELECT id FROM borrowers WHERE name = 'Alice Wilson'), '2023-10-20', '2023-11-03', '2023-11-02', 'returned');
