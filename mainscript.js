document.addEventListener('DOMContentLoaded', () => {
    const darkModeCheckbox = document.getElementById('dark-mode-checkbox');
    const body = document.body;

    // Check for saved theme in localStorage and apply it
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        if(darkModeCheckbox) darkModeCheckbox.checked = true;
    }

    // Add event listener to the toggle
    if (darkModeCheckbox) {
        darkModeCheckbox.addEventListener('change', () => {
            if (darkModeCheckbox.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }
});