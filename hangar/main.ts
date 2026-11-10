import { mount } from 'svelte';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import Hangar from './Hangar.svelte';

mount(Hangar, { target: document.getElementById('hangar')! });
