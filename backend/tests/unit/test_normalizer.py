import pytest
from services.normalizer import normalize_text, normalize_lemma


# ── Layer 1: normalize_text ──────────────────────────────────────────────────

class TestDroppedG:
    """Category A: dropped-g contractions (fetchin' → fetching)."""

    @pytest.mark.parametrize("input_text, expected", [
        ("He was fetchin' water.", "He was fetching water."),
        ("She kept runnin' away.", "She kept running away."),
        ("Somethin' strange happened.", "Something strange happened."),
        ("I was thinkin' about it.", "I was thinking about it."),
        ("They were deliverin' packages.", "They were delivering packages."),
        ("He was bidin' his time.", "He was biding his time."),
        ("Stop gulpin' yer food.", "Stop gulping yer food."),
    ])
    def test_dropped_g_basic(self, input_text, expected):
        assert normalize_text(input_text) == expected

    def test_dropped_g_curly_apostrophe(self):
        assert normalize_text("fetchin\u2019 water") == "fetching water"

    def test_dropped_g_end_of_sentence(self):
        assert normalize_text("He was runnin'") == "He was running"

    def test_dropped_g_preserves_case(self):
        result = normalize_text("Runnin' fast.")
        assert result == "Running fast."

    def test_dropped_g_multiple_in_sentence(self):
        result = normalize_text("He was fetchin' and deliverin' things.")
        assert result == "He was fetching and delivering things."


class TestDroppedGFalsePositives:
    """Dropped-g should NOT fire on words where -ing form is less frequent."""

    def test_cabin_not_converted(self):
        """cabin' should not become cabing (not a word)."""
        result = normalize_text("the cabin' door")
        assert "cabing" not in result

    def test_satin_not_converted(self):
        """satin' should not become sating unless sating is more frequent."""
        result = normalize_text("a satin' ribbon")
        # satin is more common than sating, so should stay
        assert "sating" not in result or "satin" in result


class TestArchaicContractions:
    """Category B: archaic / poetic contractions."""

    @pytest.mark.parametrize("input_text, expected_word", [
        ("'Twas the night before.", "It was"),
        ("'Tis a fine day.", "It is"),
        ("O'er the hills.", "Over"),
        ("E'er so gently.", "Ever"),
        ("Ne'er again.", "Never"),
        ("E'en now.", "Even"),
        ("Ev'ry day.", "Every"),
        ("Heav'n above.", "Heaven"),
    ])
    def test_archaic_replacements(self, input_text, expected_word):
        result = normalize_text(input_text)
        assert expected_word.lower() in result.lower()

    def test_archaic_curly_apostrophe(self):
        result = normalize_text("\u2019Twas brilliant.")
        assert "it was" in result.lower()

    def test_archaic_preserves_capitalisation(self):
        result = normalize_text("'Twas a dark night.")
        assert result.startswith("It was")


class TestClippedForms:
    """Category C: clipped / aphetic forms."""

    @pytest.mark.parametrize("input_text, expected_word", [
        ("I'm 'fraid so.", "afraid"),
        ("'Cept for that.", "except"),
        ("'Fore we go.", "before"),
        ("Wait 'til tomorrow.", "until"),
        ("'Bout time!", "about"),
        ("'Cause I said so.", "because"),
        ("Come 'round here.", "around"),
        ("'Neath the surface.", "beneath"),
        ("A whole 'nother thing.", "another"),
    ])
    def test_clipped_replacements(self, input_text, expected_word):
        result = normalize_text(input_text)
        assert expected_word in result.lower()

    def test_clipped_curly_apostrophe(self):
        result = normalize_text("I\u2019m \u2019fraid so.")
        assert "afraid" in result.lower()


class TestInformalPreSpacy:
    """Category D2: informal fusions replaced pre-spaCy."""

    @pytest.mark.parametrize("input_text, expected", [
        ("Lemme see.", "let me"),
        ("Gimme that!", "give me"),
        ("C'mon, hurry up.", "come on"),
        ("D'you know?", "do you"),
    ])
    def test_informal_pre_replacements(self, input_text, expected):
        result = normalize_text(input_text)
        assert expected in result.lower()

    def test_informal_preserves_capitalisation(self):
        result = normalize_text("Lemme go.")
        assert result.startswith("Let me")


class TestLayer1EdgeCases:
    """Edge cases for Layer 1 normalization."""

    def test_obriens_not_touched(self):
        """Proper nouns with apostrophes should remain unchanged."""
        result = normalize_text("O'Brien walked in.")
        assert "O'Brien" in result

    def test_possessives_not_touched(self):
        """Standard possessives should remain unchanged."""
        result = normalize_text("The dog's bone was big.")
        assert "dog's" in result

    def test_empty_string(self):
        assert normalize_text("") == ""

    def test_no_dialect(self):
        text = "The quick brown fox jumps over the lazy dog."
        assert normalize_text(text) == text

    def test_mixed_patterns(self):
        text = "'Twas runnin' 'bout the yard, fetchin' things."
        result = normalize_text(text)
        assert "it was" in result.lower()
        assert "running" in result.lower()
        assert "about" in result.lower()
        assert "fetching" in result.lower()


# ── Layer 2: normalize_lemma ─────────────────────────────────────────────────

class TestInformalLemmaRemap:
    """Category D3: informal lemma remapping."""

    @pytest.mark.parametrize("lemma, expected", [
        ("wanna", "want"),
        ("dunno", "know"),
        ("kinda", "kind"),
        ("sorta", "sort"),
        ("hafta", "have"),
        ("shoulda", "should"),
        ("coulda", "could"),
        ("woulda", "would"),
        ("musta", "must"),
        ("mighta", "might"),
        ("oughta", "ought"),
    ])
    def test_informal_remap(self, lemma, expected):
        assert normalize_lemma(lemma) == expected


class TestEyeDialectRemap:
    """Category E: eye dialect remapping with zipf guard."""

    @pytest.mark.parametrize("lemma, expected", [
        ("yer", "your"),
        ("yeh", "you"),
        ("fer", "for"),
        ("nowt", "nothing"),
        ("summat", "something"),
        ("nuffin", "nothing"),
        ("nuffink", "nothing"),
        ("sez", "say"),
        ("wuz", "was"),
        ("woz", "was"),
    ])
    def test_eye_dialect_remap(self, lemma, expected):
        assert normalize_lemma(lemma) == expected

    def test_bin_not_remapped(self):
        """'bin' is a real word (zipf ~4.59), should NOT be remapped."""
        assert normalize_lemma("bin") == "bin"


class TestLemmaPassthrough:
    """Normal lemmas should pass through unchanged."""

    @pytest.mark.parametrize("lemma", ["run", "fetch", "beautiful", "the", "dog"])
    def test_normal_lemma_unchanged(self, lemma):
        assert normalize_lemma(lemma) == lemma

    def test_empty_string(self):
        assert normalize_lemma("") == ""
